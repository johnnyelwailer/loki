const { createStorybookConfigurator } = require('@loki/browser');

function loadOptionalStorybook() {
  try {
    // eslint-disable-next-line global-require
    return require('@storybook/react');
  } catch (error) {
    if (
      error &&
      (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_REQUIRE_ESM') &&
      typeof error.message === 'string' &&
      error.message.includes('@storybook/react')
    ) {
      return undefined;
    }

    throw error;
  }
}

const storybook = loadOptionalStorybook();

module.exports = createStorybookConfigurator(storybook);
