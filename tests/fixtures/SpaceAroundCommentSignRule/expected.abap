CLASS any_class DEFINITION.
  PUBLIC SECTION.
  METHODS space_around_comment_sign.
ENDCLASS.


CLASS any_class IMPLEMENTATION.
  METHOD space_around_comment_sign.





    CLEAR ev_result. " to put a space between the " and the text.

    lv_value = 0. " the same is true at line end

    ls_pair = VALUE #(
                       a = '3.1415'
                       b = '1.4142' ). " sqrt(2); final comment
  ENDMETHOD.
ENDCLASS.
