CLASS lcl_any IMPLEMENTATION.
  METHOD no_alignment.
    IF iv_value = 1.

    ELSE. " comment stays inside

    ENDIF. " comment else branch

    CASE iv_value.

    WHEN 1. " comment before when

  ENDCASE. " comment inside when

  TRY.

  CATCH cx_any. " comment before catch

  ENDTRY. " handler comment
ENDMETHOD.
ENDCLASS.
