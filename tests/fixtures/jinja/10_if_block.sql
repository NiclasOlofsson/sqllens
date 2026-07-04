select
    order_id,
    amount
from orders
{% if is_incremental() %}
where updated_at > (select max(updated_at) from {{ this }})
{% endif %}
