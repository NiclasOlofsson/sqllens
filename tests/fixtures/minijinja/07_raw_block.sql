select
    {% raw %}{{ this_is_literal }} {% not_a_tag %}{% endraw %} as literal_col,
    id
from things
