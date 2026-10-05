/* eslint-disable no-underscore-dangle */

const createChannel = () => {
  const listeners = {};
  return {
    emit: jest.fn(),
    on: jest.fn((eventName, callback) => {
      listeners[eventName] = callback;
    }),
    listeners,
  };
};

const mockReactNative = () => ({
  NativeModules: {},
  Platform: { OS: 'ios' },
  StatusBar: { setHidden: jest.fn() },
  LogBox: { ignoreAllLogs: jest.fn() },
});

const loadConfigurator = ({ storybook, addons }) => {
  jest.resetModules();
  jest.doMock('react-native', () => mockReactNative(), { virtual: true });
  jest.doMock(
    'react-native/Libraries/Core/ExceptionsManager',
    () => ({ handleException: jest.fn() }),
    { virtual: true }
  );
  jest.doMock('./ready-state-manager', () => ({
    awaitReady: jest.fn().mockResolvedValue(undefined),
    resetPendingPromises: jest.fn(),
  }));
  const moduleFactory = (moduleValue) =>
    typeof moduleValue === 'function' ? moduleValue : () => moduleValue;
  jest.doMock('@storybook/react-native', moduleFactory(storybook), {
    virtual: true,
  });
  jest.doMock('@storybook/addons', moduleFactory(addons), { virtual: true });

  // eslint-disable-next-line global-require
  return require('./configure-storybook-react-native');
};

describe('configureStorybookReactNative', () => {
  afterEach(() => {
    delete global.view;
    delete global.__STORYBOOK_ADDONS_CHANNEL__;
    delete global.__STORYBOOK_PREVIEW__;
    delete global.ErrorUtils;
    jest.resetModules();
    jest.dontMock('@storybook/react-native');
    jest.dontMock('@storybook/addons');
  });

  it('keeps legacy raw stories and addon channels working', async () => {
    const channel = createChannel();
    const storybook = {
      raw: jest.fn().mockReturnValue([
        {
          id: 'button--primary',
          kind: 'Button',
          story: 'Primary',
          parameters: { loki: { skip: false } },
        },
      ]),
    };
    const configureStorybookReactNative = loadConfigurator({
      storybook,
      addons: { addons: { getChannel: () => channel } },
    });

    await configureStorybookReactNative();
    await channel.listeners['loki:getStories']({ platform: 'ios' });

    expect(storybook.raw).toHaveBeenCalledTimes(1);
    expect(channel.emit).toHaveBeenCalledWith('loki:setStories', {
      platform: 'ios',
      stories: [
        {
          id: 'button--primary',
          kind: 'Button',
          story: 'Primary',
          parameters: { loki: { skip: false } },
        },
      ],
    });
  });

  it('uses the modern Storybook React Native view without legacy packages', async () => {
    const channel = createChannel();
    global.view = {
      _channel: channel,
    };
    const preview = {
      ready: jest.fn().mockResolvedValue(undefined),
      extract: jest.fn().mockResolvedValue({
        'button--primary': {
          id: 'button--primary',
          kind: 'Button',
          story: 'Primary',
          parameters: { loki: { skip: false } },
        },
      }),
    };
    global.__STORYBOOK_PREVIEW__ = preview;

    const configureStorybookReactNative = loadConfigurator({
      storybook: () => {
        const error = new Error("Cannot find module '@storybook/react-native'");
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      },
      addons: () => {
        const error = new Error("Cannot find module '@storybook/addons'");
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      },
    });

    await configureStorybookReactNative();
    await channel.listeners['loki:getStories']({ platform: 'ios' });

    expect(preview.ready).toHaveBeenCalledTimes(1);
    expect(preview.extract).toHaveBeenCalledTimes(1);
    expect(channel.emit).toHaveBeenCalledWith('loki:setStories', {
      platform: 'ios',
      stories: [
        {
          id: 'button--primary',
          kind: 'Button',
          story: 'Primary',
          parameters: { loki: { skip: false } },
        },
      ],
    });
  });

  it('loads without Storybook packages when the integration is imported', () => {
    expect(() =>
      loadConfigurator({
        storybook: () => {
          const error = new Error(
            "Cannot find module '@storybook/react-native'"
          );
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        },
        addons: () => {
          const error = new Error("Cannot find module '@storybook/addons'");
          error.code = 'MODULE_NOT_FOUND';
          throw error;
        },
      })
    ).not.toThrow();
  });
});
