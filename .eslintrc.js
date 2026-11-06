module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['server/node_modules/', 'ios/', 'android/', 'coverage/'],
  overrides: [
    {
      files: ['server/**/*.js'],
      env: {node: true},
    },
  ],
};
