CLASS lcl_any IMPLEMENTATION.
  METHOD select_examples.
    SELECT SINGLE field_a INTO lv_value FROM dtab WHERE field_b = iv_key.
    SELECT * FROM dtab INTO TABLE @ DATA(lt_items ).
    SELECT * FROM dtab APPENDING TABLE lt_items.
  ENDMETHOD.
ENDCLASS.
