import ts from 'typescript';

/**
 * Bounded research lowering, explicitly invoked by tests. No package integration.
 * `signals` is a fixture-supplied binding list, not production symbol resolution.
 */
export function lower(source: string, signals: readonly string[]): string {
  const names = new Set(signals);
  const input = ts.createSourceFile('opt-in-view.ts', source, ts.ScriptTarget.Latest, true);
  const reactiveRead = (node: ts.Node): boolean => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return false;
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'value' && ts.isIdentifier(node.expression) && names.has(node.expression.text)) return true;
    let found = false;
    ts.forEachChild(node, child => { if (reactiveRead(child)) found = true; });
    return found;
  };
  const scalar = (node: ts.Expression): boolean => {
    if (ts.isIdentifier(node) || ts.isNumericLiteral(node) || ts.isStringLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
    if (ts.isPropertyAccessExpression(node)) return node.name.text === 'value' && ts.isIdentifier(node.expression) && names.has(node.expression.text);
    if (ts.isParenthesizedExpression(node)) return scalar(node.expression);
    if (ts.isPrefixUnaryExpression(node)) return [ts.SyntaxKind.ExclamationToken, ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.TildeToken].includes(node.operator) && scalar(node.operand);
    if (ts.isBinaryExpression(node)) return [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken, ts.SyntaxKind.AsteriskToken, ts.SyntaxKind.SlashToken, ts.SyntaxKind.PercentToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind) && scalar(node.left) && scalar(node.right);
    if (ts.isConditionalExpression(node)) return scalar(node.condition) && scalar(node.whenTrue) && scalar(node.whenFalse);
    return false;
  };
  const transformed = ts.transform(input, [context => {
    const visit: ts.Visitor = node => {
      if (ts.isTaggedTemplateExpression(node) && ts.isIdentifier(node.tag) && node.tag.text === 'html' && ts.isTemplateExpression(node.template)) {
        const spans = node.template.templateSpans.map(span => {
          const expression = ts.visitNode(span.expression, visit) as ts.Expression;
          // Explicit untrack retains the existing one-shot snapshot capability.
          if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && ['computed', 'untrack', 'each', 'when'].includes(expression.expression.text)) return ts.factory.updateTemplateSpan(span, expression, span.literal);
          if (!reactiveRead(expression)) return ts.factory.updateTemplateSpan(span, expression, span.literal);
          if (!scalar(expression)) throw new Error('Unsupported reactive expression: keep an explicit computed() or signal prop; no heuristic rewrite');
          if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'value') return ts.factory.updateTemplateSpan(span, expression.expression, span.literal);
          const thunk = ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), expression);
          return ts.factory.updateTemplateSpan(span, ts.factory.createCallExpression(ts.factory.createIdentifier('computed'), undefined, [thunk]), span.literal);
        });
        return ts.factory.updateTaggedTemplateExpression(node, node.tag, node.typeArguments, ts.factory.updateTemplateExpression(node.template, node.template.head, spans));
      }
      return ts.visitEachChild(node, visit, context);
    };
    return root => ts.visitNode(root, visit) as ts.SourceFile;
  }]);
  try { return ts.createPrinter().printFile(transformed.transformed[0]!); }
  finally { transformed.dispose(); }
}
