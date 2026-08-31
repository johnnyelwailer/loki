/* eslint-disable no-underscore-dangle */

const blockedParams = [
  'actions',
  'argTypes',
  'backgrounds',
  'controls',
  'docs',
  'framework',
  'storySource',
];

const isSerializable = (value) => {
  try {
    return JSON.stringify(value) !== undefined;
  } catch (_e) {
    return false;
  }
};

const normalizeStories = (stories) =>
  stories
    .map((component) => ({
      id: component.id,
      kind: component.kind,
      story: component.story,
      parameters: Object.fromEntries(
        Object.entries(component.parameters || {}).filter(
          ([key, value]) =>
            !key.startsWith('__') &&
            !blockedParams.includes(key) &&
            isSerializable(value)
        )
      ),
    }))
    .filter(({ parameters }) => !parameters.loki || !parameters.loki.skip);

const getStories = async (window) => {
  const preview = window.__STORYBOOK_PREVIEW__;
  const clientApi = window.__STORYBOOK_CLIENT_API__;

  if (preview && typeof preview.extract === 'function') {
    // Storybook 9 removed the StoryStore and its raw() method. The preview API
    // is the supported way to read all stories from Storybook 8 onward.
    if (typeof preview.ready === 'function') {
      await preview.ready();
    }

    const extracted = await preview.extract();
    return normalizeStories(
      Array.isArray(extracted) ? extracted : Object.values(extracted || {})
    );
  }

  const getStorybook =
    (clientApi && clientApi.raw) ||
    (preview && preview.storyStore && preview.storyStore.raw) ||
    (window.loki && window.loki.getStorybook);
  if (!getStorybook) {
    throw new Error(
      "Unable to get stories. Try adding `import 'loki/configure-react'` to your .storybook/preview.js file."
    );
  }

  if (
    clientApi &&
    clientApi.storyStore &&
    clientApi.storyStore.cacheAllCSFFiles
  ) {
    await clientApi.storyStore.cacheAllCSFFiles();
  }

  return normalizeStories(getStorybook());
};

module.exports = getStories;
