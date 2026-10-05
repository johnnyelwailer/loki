/* eslint-disable import/no-dynamic-require, import/no-extraneous-dependencies, import/no-unresolved, global-require, no-underscore-dangle */

function loadOptionalModule(name) {
  try {
    return require(name);
  } catch (error) {
    if (
      error &&
      error.code === 'MODULE_NOT_FOUND' &&
      typeof error.message === 'string' &&
      error.message.includes(name)
    ) {
      return undefined;
    }

    throw error;
  }
}

const storybookModule = loadOptionalModule('@storybook/react-native');
const storybook =
  storybookModule && (storybookModule.default || storybookModule);
const addonsModule = loadOptionalModule('@storybook/addons');
const addons =
  addonsModule && (addonsModule.default || addonsModule.addons || addonsModule);
const ReactNative = require('react-native');
const ExceptionsManager = require('react-native/Libraries/Core/ExceptionsManager');
const readyStateManager = require('./ready-state-manager');

const { awaitReady, resetPendingPromises } = readyStateManager;
const { DevSettings } = ReactNative.NativeModules;

const MESSAGE_PREFIX = 'loki:';
const hasDevSettings = !!DevSettings && !!DevSettings.reload;

let customErrorHandler;

function injectLokiGlobalErrorHandler() {
  if (!global.ErrorUtils) {
    return;
  }

  function genericErrorHandler(e, isFatal) {
    if (customErrorHandler) {
      customErrorHandler(e, isFatal);
    }
    try {
      ExceptionsManager.handleException(e, isFatal);
    } catch (ee) {
      // eslint-disable-next-line no-console
      console.log('Failed to print error: ', ee.message);
      throw e;
    }
  }

  global.ErrorUtils.setGlobalHandler(genericErrorHandler);
}

async function getPrettyError(error) {
  const message = String(error.message).split('\n')[0];
  if (ReactNative.NativeModules.ExceptionsManager) {
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack');
    const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace');
    const stack = parseErrorStack(error);
    const prettyStack = await symbolicateStackTrace(stack);
    return {
      message,
      stack: prettyStack,
    };
  }
  return {
    message,
  };
}

function getCurrentStorybookChannel() {
  if (global.view && global.view._channel) {
    return global.view._channel;
  }
  if (global.__STORYBOOK_ADDONS_CHANNEL__) {
    return global.__STORYBOOK_ADDONS_CHANNEL__;
  }
  if (addons && typeof addons.getChannel === 'function') {
    return addons.getChannel();
  }
  return undefined;
}

function getAddonsChannel() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attemptChannel = () => {
      tries++;
      try {
        const channel = getCurrentStorybookChannel();
        if (channel) {
          resolve(channel);
          return;
        }
        throw new Error('Storybook channel is not available yet');
      } catch (error) {
        if (tries < 10) {
          setTimeout(attemptChannel, 100);
        } else {
          reject(
            new Error(`Failed getting addons channel after ${tries} tries`)
          );
        }
      }
    };
    setTimeout(attemptChannel, 0);
  });
}

function isSerializable(value) {
  try {
    JSON.stringify(value);
    return true;
  } catch (_e) {
    return false;
  }
}

function normalizeStories(stories) {
  return stories
    .map((component) => ({
      id: component.id,
      kind: component.kind,
      story: component.story,
      parameters: Object.fromEntries(
        Object.entries(component.parameters || {}).filter(
          ([key, value]) => !key.startsWith('__') && isSerializable(value)
        )
      ),
    }))
    .filter(({ parameters }) => !parameters.loki || !parameters.loki.skip);
}

async function getModernStories() {
  const { view } = global;
  if (!view || !view._storyIndex || !view._preview) {
    return undefined;
  }

  if (typeof view.createPreparedStoryMapping === 'function') {
    await view.createPreparedStoryMapping();
  }

  const { entries: storyEntries } = view._storyIndex;
  const entries = Object.values(storyEntries || {}).filter(
    (entry) => !entry.type || entry.type === 'story'
  );
  const stories = await Promise.all(
    entries.map(async (entry) => {
      const preparedStory = view._idToPrepared && view._idToPrepared[entry.id];
      const context =
        preparedStory && typeof view._preview.getStoryContext === 'function'
          ? await view._preview.getStoryContext(preparedStory)
          : {};

      return {
        id: entry.id,
        kind: context.kind || context.title || entry.title,
        story: context.story || context.name || entry.name,
        parameters: context.parameters || entry.parameters || {},
      };
    })
  );

  return normalizeStories(stories);
}

async function getStorybookStories() {
  const preview = global.__STORYBOOK_PREVIEW__;
  if (preview && typeof preview.extract === 'function') {
    if (typeof preview.ready === 'function') {
      await preview.ready();
    }
    const extracted = await preview.extract();
    return normalizeStories(
      Array.isArray(extracted) ? extracted : Object.values(extracted || {})
    );
  }

  const modernStories = await getModernStories();
  if (modernStories) {
    return modernStories;
  }

  if (storybook && typeof storybook.raw === 'function') {
    return normalizeStories(await storybook.raw());
  }

  throw new Error('Unable to get stories from React Native Storybook');
}

async function configureStorybook() {
  injectLokiGlobalErrorHandler();

  // Monkey patch `Image`
  Object.defineProperty(ReactNative, 'Image', {
    configurable: true,
    enumerable: true,
    get: () => require('./ready-state-emitting-image'),
  });

  const channel = await getAddonsChannel();
  const platform = ReactNative.Platform.OS;

  const on = (eventName, callback) =>
    channel.on(`${MESSAGE_PREFIX}${eventName}`, (params) => {
      if (params && params.platform === platform) {
        return callback(params);
      }
      return undefined;
    });

  const emit = (eventName, params = {}) =>
    channel.emit(
      `${MESSAGE_PREFIX}${eventName}`,
      Object.assign({ platform }, params)
    );

  const originalState = {
    statusBarHidden: false, // TODO: get actual value
  };

  const restore = () => {
    if ('loki' in global) {
      global.loki.isRunning = true;
    }

    customErrorHandler = null;
    ReactNative.StatusBar.setHidden(originalState.statusBarHidden);
    ReactNative.LogBox.ignoreAllLogs(false);
  };

  const prepare = () => {
    if (!('loki' in global)) {
      global.loki = {};
    }
    global.loki.isRunning = true;

    customErrorHandler = async (error, isFatal) => {
      if (isFatal) {
        emit('error', {
          error: await getPrettyError(error),
          isFatal,
          canHeal: hasDevSettings,
        });
        restore();
        if (hasDevSettings) {
          setTimeout(() => {
            DevSettings.reload();
          }, 1000);
        }
      }
    };
    if (hasDevSettings) {
      DevSettings.setHotLoadingEnabled(false);
    }
    ReactNative.StatusBar.setHidden(true, 'none');
    ReactNative.LogBox.ignoreAllLogs(true);
  };

  on('prepare', () => {
    prepare();
    setTimeout(() => emit('didPrepare'), platform === 'android' ? 500 : 0);
  });

  on('restore', () => {
    restore();
    emit('didRestore');
  });

  on('getStories', () =>
    getStorybookStories().then((stories) => emit('setStories', { stories }))
  );

  channel.on('setCurrentStory', async () => {
    try {
      await awaitReady();
      emit('ready');
    } catch (error) {
      emit('error', {
        error: {
          message: error.message,
        },
        isFatal: false,
      });
    }
    resetPendingPromises();
  });
}

module.exports = configureStorybook;
