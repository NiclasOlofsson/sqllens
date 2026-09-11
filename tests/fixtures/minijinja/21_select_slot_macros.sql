{{ config(
    tags = ["salesforecast","anaplan","bro"]
) }}
select
    {{bronze_key_cleaning('sf.dataareaid')}} as companykey
    ,{{bronze_date_cleaning('forecastcreatedate')}} as forecastcreatedate
    ,{{bronze_key_cleaning('sf.itemid')}} as itemkey,
    'anaplan' as sourcesystemkey,
    sf.quantity,
    sf.modified_datetime as max_modified_datetime
from {{ ref('anaplan__salesforecastdaily') }} as sf
where
    coalesce(sf.dataareaid, 0) <> 0
    and left(forecastdate, 7) >= left(forecastcreatedate, 7)
