describe('configureStorybookVue', () => {
  afterEach(() => {
    delete global.window;
    jest.resetModules();
    jest.dontMock('@storybook/vue');
  });

  it('keeps the legacy Storybook Vue helper available', () => {
    const legacyStorybook = { clientApi: 'legacy' };
    jest.doMock('@storybook/vue', () => legacyStorybook, { virtual: true });

    // eslint-disable-next-line global-require
    const configureStorybookVue = require('./configure-storybook-vue');
    global.window = {};

    configureStorybookVue();

    expect(global.window.loki.getStorybook()).toBe(legacyStorybook);
  });

  it('loads without the legacy package for modern Storybook projects', () => {
    jest.doMock(
      '@storybook/vue',
      () => {
        const error = new Error("Cannot find module '@storybook/vue'");
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      },
      { virtual: true }
    );

    // eslint-disable-next-line global-require
    const configureStorybookVue = require('./configure-storybook-vue');
    global.window = {};

    expect(() => configureStorybookVue()).not.toThrow();
    expect(global.window.loki.getStorybook()).toBeUndefined();
  });

  it('is safe to load outside a browser context', () => {
    // eslint-disable-next-line global-require
    const configureStorybookVue = require('./configure-storybook-vue');

    expect(() => configureStorybookVue()).not.toThrow();
  });
});
