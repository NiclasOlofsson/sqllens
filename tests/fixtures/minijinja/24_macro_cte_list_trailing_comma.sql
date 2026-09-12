{% macro level_ctes() %}
{% set n = 3 %}
base as (select 1 as id),
{% for i in range(n) %}
level_{{ i }} as (select id from base where id = {{ i }}),
{% endfor %}
final as (select id from base),
{% endmacro %}

with
{{ level_ctes() }}
select * from final
