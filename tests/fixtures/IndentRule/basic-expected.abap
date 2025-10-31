CLASS lcl_any IMPLEMENTATION.
  METHOD basic.
    DO 2 TIMES.
      LOOP AT its_table ASSIGNING FIELD -SYMBOL(<ls_row> ).
        IF <ls_row> -IGNORE = abap_true.

          CONTINUE. " comment
        ENDIF.
      ENDLOOP.
    ENDDO.
  ENDMETHOD.
ENDCLASS.
