{% set payment_methods = ['bank', 'card'] %}

{% macro to_cents(col) %}
    {{ col }} * 100
{% endmacro %}

select
    order_id,
    amount
from orders
where amount > 0
