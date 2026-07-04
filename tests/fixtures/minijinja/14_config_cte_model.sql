{{ config(materialized='incremental', unique_key='order_id') }}

with orders as (
    select * from {{ ref('stg_orders') }}
),

customers as (
    select * from {{ source('raw', 'customers') }}
)

select
    o.order_id,
    c.customer_name,
    o.amount
from orders as o
left join customers as c
    on o.customer_id = c.customer_id
