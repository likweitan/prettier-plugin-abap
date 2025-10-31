CLASS any_class DEFINITION .
  PUBLIC SECTION .
    DATA: mv_any_data TYPE i   ,
          mv_other_data TYPE string . 

    METHODS space_before_period_or_comma .
ENDCLASS.


CLASS any_class IMPLEMENTATION.
  METHOD space_before_period_or_comma .
    DATA: lo_object TYPE cl_any_class ##NEEDED
          , lo_other_object TYPE cl_other_class .

    CLEAR:
      ev_any_value  ,
      ev_other_value " comment
      , ev_third_value
*      comment line
       " another comment line
      , ev_fourth_value
    .

    TRY .
        any_operation( ) .
      CATCH cx_any .
    ENDTRY .

    lv_value = 42 " comment
    .
  ENDMETHOD.
ENDCLASS.
