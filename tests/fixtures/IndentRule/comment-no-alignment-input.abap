CLASS lcl_any IMPLEMENTATION.
METHOD no_alignment.
IF iv_value = 1.
" comment stays inside
ELSE.
" comment else branch
ENDIF.

CASE iv_value.
" comment before when
WHEN 1.
" comment inside when
ENDCASE.

TRY.
" comment before catch
CATCH cx_any.
" handler comment
ENDTRY.
ENDMETHOD.
ENDCLASS.

