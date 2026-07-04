select
    id,
    created_at
from {{ source('raw', 'events') }}
where created_at >= '2020-01-01'
