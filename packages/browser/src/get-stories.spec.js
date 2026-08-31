const getStories = require('./get-stories');

describe('getStories', () => {
  it('uses the supported preview extract API for Storybook 9 and newer', async () => {
    const preview = {
      ready: jest.fn().mockResolvedValue(undefined),
      extract: jest.fn().mockResolvedValue({
        'button--primary': {
          id: 'button--primary',
          kind: 'Button',
          story: 'Primary',
          parameters: {
            actions: { argTypesRegex: '^on[A-Z].*' },
            __internal: 'ignore',
            loki: { skip: false },
          },
        },
        'button--skipped': {
          id: 'button--skipped',
          kind: 'Button',
          story: 'Skipped',
          parameters: { loki: { skip: true } },
        },
      }),
    };

    await expect(
      getStories({ __STORYBOOK_PREVIEW__: preview })
    ).resolves.toEqual([
      {
        id: 'button--primary',
        kind: 'Button',
        story: 'Primary',
        parameters: { loki: { skip: false } },
      },
    ]);
    expect(preview.ready).toHaveBeenCalledTimes(1);
    expect(preview.extract).toHaveBeenCalledTimes(1);
  });

  it('keeps the legacy global fallback working without a client API', async () => {
    await expect(
      getStories({
        loki: {
          getStorybook: () => [
            {
              id: 'button--primary',
              kind: 'Button',
              story: 'Primary',
              parameters: {},
            },
          ],
        },
      })
    ).resolves.toEqual([
      {
        id: 'button--primary',
        kind: 'Button',
        story: 'Primary',
        parameters: {},
      },
    ]);
  });
});
