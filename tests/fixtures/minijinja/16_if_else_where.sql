select
    order_id,
    amount,
    status
from {{ ref('stg_orders') }}
{% if target.name == 'prod' %}
where status = 'complete'
{% else %}
where status <> 'cancelled'
{% endif %}
