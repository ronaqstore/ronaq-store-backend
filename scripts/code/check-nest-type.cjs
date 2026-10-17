'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Inline Object Type Literals Audit', { emoji: '📦' });
const srcRoot = path.join(__dirname, '../../src');

function hasInlineObjectType(tsType) {
  if (!tsType) return false;
  if (
    tsType.type === 'TSTypeLiteral' &&
    tsType.members &&
    tsType.members.length > 0
  ) {
    return true;
  }
  if (tsType.type === 'TSArrayType')
    return hasInlineObjectType(tsType.elementType);
  if (tsType.type === 'TSUnionType' || tsType.type === 'TSIntersectionType') {
    return tsType.types.some(hasInlineObjectType);
  }
  if (tsType.type === 'TSOptionalType')
    return hasInlineObjectType(tsType.typeAnnotation);
  return false;
}

function checkType(node, relPath, context) {
  if (!node) return;
  const tsType = node.typeAnnotation || node;
  const target = tsType.typeAnnotation || tsType;
  if (hasInlineObjectType(target)) {
    r.addViolation(
      relPath,
      target.loc ? target.loc.start.line : 0,
      `Forbidden inline object type in ${context} — extract a named type/DTO/interface`,
    );
  }
}

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.replace(/\\/g, '/');
    if (
      relPath.includes('src/generated/') ||
      relPath.includes('/dto/') ||
      relPath.includes('/common-dto/') ||
      relPath.endsWith('.d.ts')
    ) {
      return;
    }

    const code = fs.readFileSync(absPath, 'utf8');
    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      FunctionDeclaration(p) {
        p.node.params.forEach((param) => {
          if (param.typeAnnotation)
            checkType(param.typeAnnotation, relPath, 'function param');
        });
      },
      ArrowFunctionExpression(p) {
        p.node.params.forEach((param) => {
          if (param.typeAnnotation)
            checkType(param.typeAnnotation, relPath, 'arrow param');
        });
      },
      ClassMethod(p) {
        p.node.params.forEach((param) => {
          if (param.typeAnnotation)
            checkType(param.typeAnnotation, relPath, 'method param');
        });
      },
    });
  });
}

r.finish({
  fixTip:
    'Prefer named DTOs/interfaces over inline `{ ... }` object types in Nest service APIs.',
});
