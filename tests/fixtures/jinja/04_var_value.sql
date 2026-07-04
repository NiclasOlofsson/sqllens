select
    order_id,
    amount * {{ var('fx_rate') }} as amount_eur
from orders
where region = '{{ var("region") }}'
