describe('configureStorybookReact', () => {
  afterEach(() => {
    delete global.window;
    jest.resetModules();
    jest.dontMock('@storybook/react');
  });

  it('keeps the legacy Storybook React helper available', () => {
    const legacyStorybook = { clientApi: 'legacy' };
    jest.doMock('@storybook/react', () => legacyStorybook, { virtual: true });

    // eslint-disable-next-line global-require
    const configureStorybookReact = require('./configure-storybook-react');
    global.window = {};

    configureStorybookReact();

    expect(global.window.loki.getStorybook()).toBe(legacyStorybook);
  });

  it('loads without the package for modern Storybook projects', () => {
    jest.doMock(
      '@storybook/react',
      () => {
        const error = new Error("Cannot find module '@storybook/react'");
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      },
      { virtual: true }
    );

    // eslint-disable-next-line global-require
    const configureStorybookReact = require('./configure-storybook-react');
    global.window = {};

    expect(() => configureStorybookReact()).not.toThrow();
    expect(global.window.loki.getStorybook()).toBeUndefined();
  });

  it('loads without the package when Storybook is ESM-only', () => {
    jest.doMock(
      '@storybook/react',
      () => {
        const error = new Error(
          'require() of ES Module @storybook/react not supported'
        );
        error.code = 'ERR_REQUIRE_ESM';
        throw error;
      },
      { virtual: true }
    );

    // eslint-disable-next-line global-require
    const configureStorybookReact = require('./configure-storybook-react');
    global.window = {};

    expect(() => configureStorybookReact()).not.toThrow();
    expect(global.window.loki.getStorybook()).toBeUndefined();
  });

  it('is safe to load outside a browser context', () => {
    jest.doMock('@storybook/react', () => ({}), { virtual: true });

    // eslint-disable-next-line global-require
    const configureStorybookReact = require('./configure-storybook-react');

    expect(() => configureStorybookReact()).not.toThrow();
  });
});
