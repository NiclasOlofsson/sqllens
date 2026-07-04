select
    {{ dbt_utils.dateadd('day', 1, order_date) }} as next_day,
    {{ pkg.macro(a, nested(b), 'lit') }} as computed
from orders
