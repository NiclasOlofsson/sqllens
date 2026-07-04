{% set payment_methods = ['bank', 'card'] %}

select
    order_id,
    {{ dbt_utils.dateadd('day', 7, 'order_date') }} as due_date,
    upper(status) as status
from {{ ref('stg_orders') }}
where amount > {{ var('min_amount') }}
