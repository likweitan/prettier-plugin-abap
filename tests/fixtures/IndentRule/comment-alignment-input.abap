CLASS lcl_any IMPLEMENTATION.
METHOD align_examples.
IF iv_value = 1.

" comment before else
ELSE.
ENDIF.

CASE iv_value.

" comment before when
WHEN 1.
ENDCASE.

TRY.

" comment before catch
CATCH cx_any.
ENDTRY.
ENDMETHOD.
ENDCLASS.

