{{ config(materialized='table') }}

select
    customer_id,
    count(*) as order_count
from orders
group by customer_id
