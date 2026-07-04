select
    m.id,
    m.name
from {{ my_macro() }} as m
