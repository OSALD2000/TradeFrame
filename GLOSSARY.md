# TradeFrame

TradeFrame records trading opportunities, decisions, and their outcomes.

## Language

**Setup**:
A trading opportunity being considered or documented, whether or not a position
is opened. A setup may contain multiple chart screenshots.
_Avoid_: Trade as a synonym for every setup.

**Trade**:
An actual position opened in response to a trading opportunity. An observed
opportunity alone is not a trade.
_Avoid_: Setup as a synonym for an executed position.

**No Trade**:
A decision not to open a position for a setup. It is neither a losing trade nor
an open trade.
_Avoid_: Loss, open trade.

**Form schema**:
A named definition of the fields used to document a setup, including their
types, required values, and dependencies. A schema revision preserves the
definition used for an earlier setup.
_Avoid_: Setup as a synonym for the form definition.

**Field definition**:
The meaning and input rules of one item in a form schema. Its identity remains
the same when its display label changes.
_Avoid_: Label as a field's identity.

**Setup values**:
The answers entered for a particular setup using a particular schema revision.
_Avoid_: Schema as a synonym for entered answers.

**Markdown key**:
The configured metadata name through which a field's answer appears in a setup
document. It is distinct from the field's display label and stable identity.
_Avoid_: Tag as a synonym for a metadata key.

**Field tag**:
A label contributed by an answered field or selected option to a setup's tags.
_Avoid_: Field ID or Markdown key as synonyms for a tag.

**Field dependency**:
A rule that makes a field applicable only when another applicable field has a
specified answer. Inapplicable answers remain draft information rather than
part of the documented setup.
_Avoid_: Formula for a visibility rule.

**Follow-up screenshot**:
A later chart view added to an already documented setup, preserving its earlier
views and reasoning.
_Avoid_: New setup when only adding another view of the same opportunity.

**Screenshot timeframe**:
The chart interval recorded for one captured view, such as 1m or 2m. Every new
saved image requires its own interval. A form's setup-level timeframe answer
remains independent; earlier files may have no recorded image interval.
_Avoid_: Caption as a substitute for the structured timeframe.
