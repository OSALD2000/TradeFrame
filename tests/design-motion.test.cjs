const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const postcss = require('postcss');

const stylesheet = postcss.parse(fs.readFileSync('src/styles.css', 'utf8'));

test('declared text and input boundaries stay legible on every standard dark surface', () => {
  const tokens = Object.fromEntries(
    stylesheet.nodes
      .find((node) => node.selector === ':root')
      .nodes.filter((node) => node.type === 'decl')
      .map((node) => [node.prop, node.value]),
  );
  const luminance = (hex) => {
    const linear = [1, 3, 5].map((offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (a, b) => (luminance(a) + 0.05) / (luminance(b) + 0.05);
  for (const surface of ['--canvas', '--surface', '--elevated', '--input'])
    for (const foreground of ['--text', '--secondary', '--muted'])
      assert.ok(
        contrast(tokens[foreground], tokens[surface]) >= 4.5,
        `${foreground} on ${surface}`,
      );
  for (const surface of ['--input', '--elevated'])
    assert.ok(
      contrast(tokens['--input-border'], tokens[surface]) >= 3,
      `Input boundary on ${surface}`,
    );
});

test('reduced motion disables animation and transitions on elements and generated decoration', () => {
  const reduced = stylesheet.nodes.find(
    (node) =>
      node.type === 'atrule' &&
      node.name === 'media' &&
      /prefers-reduced-motion:\s*reduce/.test(node.params),
  );
  assert.ok(reduced, 'A reduced-motion alternative is required');
  const rule = reduced.nodes.find(
    (node) =>
      node.type === 'rule' &&
      ['*', '*::before', '*::after', '*::backdrop'].every((selector) =>
        node.selectors.includes(selector),
      ),
  );
  assert.ok(rule, 'Decorative pseudo-elements must respect the preference too');
  for (const [property, expected] of [
    ['animation', 'none'],
    ['transition', 'none'],
    ['scroll-behavior', 'auto'],
  ]) {
    const declaration = rule.nodes.find((node) => node.prop === property);
    assert.equal(declaration?.value, expected);
    assert.equal(declaration?.important, true);
  }
  const hover = reduced.nodes.find(
    (node) => node.type === 'rule' && node.selectors.includes('.source-option:hover'),
  );
  assert.ok(
    hover.nodes.some(
      (node) => node.prop === 'transform' && node.value === 'none' && node.important,
    ),
  );
});

test('continuous animation is confined to visible loading indicators and never changes layout geometry', () => {
  let loops = 0;
  stylesheet.walkDecls((declaration) => {
    if (declaration.prop === 'transition') assert.doesNotMatch(declaration.value, /\ball\b/);
    if (/^animation/.test(declaration.prop) && /\binfinite\b/.test(declaration.value)) {
      loops++;
      assert.deepEqual([...declaration.parent.selectors].sort(), [
        '.loading-status::before',
        '.workspace-status::before',
      ]);
    }
  });
  assert.equal(loops, 1);
  stylesheet.walkAtRules('keyframes', (animation) => {
    animation.walkDecls((declaration) => {
      assert.ok(
        ['opacity', 'transform', 'stroke-dashoffset'].includes(declaration.prop),
        `${animation.params} must not animate layout geometry`,
      );
    });
  });
});

test('motion styling keeps interactive targets large and disabled controls immediate', () => {
  stylesheet.walkRules((rule) => {
    if (!/(?:button|bar-return|bar-close)/.test(rule.selector)) return;
    for (const declaration of rule.nodes) {
      if (declaration.prop === 'min-height' && /^\d+px$/.test(declaration.value))
        assert.ok(parseFloat(declaration.value) >= 44, rule.selector);
    }
  });
  const disabled = stylesheet.nodes.find(
    (node) => node.type === 'rule' && node.selector === 'button:disabled',
  );
  assert.ok(disabled.nodes.some((node) => node.prop === 'transition' && node.value === 'none'));
});
