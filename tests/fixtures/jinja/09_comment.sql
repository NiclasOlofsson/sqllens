{# this model rolls orders up to the customer grain #}
select
    customer_id,
    sum(amount) as total
from orders
group by customer_id
