CLASS lcl_any IMPLEMENTATION.
  METHOD align_examples.
    IF iv_value = 1.


    ELSE. " comment before else
    ENDIF.

    CASE iv_value.


    WHEN 1. " comment before when
  ENDCASE.

  TRY.


  CATCH cx_any. " comment before catch
  ENDTRY.
ENDMETHOD.
ENDCLASS.
