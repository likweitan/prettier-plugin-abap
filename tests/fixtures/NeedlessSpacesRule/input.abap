CLASS any_class IMPLEMENTATION.
  METHOD remove_needless_spaces.
    a       =  1.
    bb      =  2.

    ccc     =  3.
    dddd    =  4.
    " comment
    eeeee   =  5.
    ffffff  =  6.

    lv_instance     ?=   get_utility( ).
    lv_any_value     =   'abc'   &&  'def'.
    lv_other_value   =   get_value( )  +  get_another_value( ).
    lv_third_value  +=   3    *   4.

    lts_table[ 1 ]-value    =      42.
    lts_table[ 2 ]-value    =    -100.
    lts_table[ 3 ]-value    =      '3.1415'.
    lts_table[ 4 ]-value    =    '-12.34'.

    ev_result = cl_any_factory=>get(     )->get_utility(   )->get_value(      ).

    get_util(    )->any_method( iv_any_param   = get_default_value(    )
                                iv_other_param = VALUE #(       ) ).
  ENDMETHOD.
ENDCLASS.
