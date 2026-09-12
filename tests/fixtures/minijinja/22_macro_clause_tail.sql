{% macro maybe_filter(col) %}
{% if col %}
{{ stat|default('where') }} {{ col }} = 0
{% endif %}
{% endmacro %}

select id
from t
{{ maybe_filter('flag') }}
