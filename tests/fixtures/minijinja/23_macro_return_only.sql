{% macro cutoff_month() %}
{# hardcoded cutoff, revisit next fiscal year #}
{{ return('202601') }}
{% endmacro %}

select {{ cutoff_month() }} as cutoff
from t
