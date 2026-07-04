select
    {% for c in columns %}{{ c }}{% if not loop.last %}, {% endif %}{% endfor %}
from events
