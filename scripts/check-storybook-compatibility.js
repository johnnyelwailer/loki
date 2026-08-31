const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const checks = [
  {
    file: 'packages/integration-react/package.json',
    dependency: '@storybook/react',
  },
  {
    file: 'packages/integration-react-native/package.json',
    dependency: '@storybook/react-native',
  },
  {
    file: 'packages/integration-react-native/package.json',
    dependency: '@storybook/addons',
  },
  {
    file: 'packages/integration-vue/package.json',
    dependency: '@storybook/vue',
  },
];

const repositoryRoot = path.resolve(__dirname, '..');

function latestVersion(dependency) {
  const value = execFileSync('npm', ['view', dependency, 'version', '--json'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(value.trim());
}

function major(version) {
  const match = String(version).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function declaredMajors(range) {
  return [...String(range).matchAll(/\^(\d+)/g)].map((match) =>
    Number(match[1])
  );
}

const failures = [];

for (const check of checks) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, check.file), 'utf8')
  );
  const range =
    manifest.peerDependencies && manifest.peerDependencies[check.dependency];
  const version = latestVersion(check.dependency);
  const latestMajor = major(version);
  const supported =
    range &&
    latestMajor !== null &&
    declaredMajors(range).includes(latestMajor);

  console.log(
    `${check.dependency}: latest ${version}; ${check.file} declares ${
      range || 'no peer range'
    }; ${supported ? 'supported' : 'unsupported'}`
  );

  if (!supported) {
    failures.push(
      `${check.file} does not declare the latest ${check.dependency} major`
    );
  }
}

if (failures.length > 0) {
  console.error('\nStorybook compatibility audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}
