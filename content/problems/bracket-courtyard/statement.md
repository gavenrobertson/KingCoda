The castle courtyard is laid out as a string `plan` of gates: `(` `[` `{` open a passage and `)` `]` `}` close one.

A closing gate must close the **most recently opened passage that is still open**, and it must be of the same kind.

Return the index of the **first** closing gate that breaks this rule. If no gate breaks it but some passages are still open at the end, return `plan.length`. If the plan is perfectly balanced, return `-1`.
