select
    {{ dbt_utils.star(from=ref('stg_orders')) }}
from {{ ref('stg_orders') }}
