select
    id
    {% for c in ['a', 'b', 'c'] %}
    , sum(case when kind = '{{ c }}' then 1 else 0 end) as cnt_{{ c }}
    {% endfor %}
from events
group by id
