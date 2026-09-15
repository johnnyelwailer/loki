const { createStorybookConfigurator } = require('@loki/browser');

function loadLegacyStorybook() {
  try {
    // eslint-disable-next-line global-require
    return require('@storybook/vue');
  } catch (error) {
    if (
      error &&
      error.code === 'MODULE_NOT_FOUND' &&
      typeof error.message === 'string' &&
      error.message.includes('@storybook/vue')
    ) {
      return undefined;
    }

    throw error;
  }
}

const storybook = loadLegacyStorybook();

module.exports = createStorybookConfigurator(storybook);
