'use strict';

const parser = require('@babel/parser');

const TS_PLUGINS = [
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
];

function parseFile(absPath, code) {
  try {
    return parser.parse(code, {
      sourceType: 'module',
      plugins: TS_PLUGINS,
      errorRecovery: false,
    });
  } catch (e) {
    return parser.parse(code, {
      sourceType: 'script',
      plugins: TS_PLUGINS,
      errorRecovery: false,
    });
  }
}

module.exports = { parseFile };
