select
    o.order_id,
    o.customer_id,
    o.amount
from {{ ref('stg_orders') }} as o
where o.amount > 0
