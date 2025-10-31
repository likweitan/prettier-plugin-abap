CLASS any_class DEFINITION.
  PUBLIC SECTION.
    METHODS space_around_comment_sign.
ENDCLASS.


CLASS any_class IMPLEMENTATION.
  METHOD space_around_comment_sign.
    "Comment signs
    "are NOT the same as "quotation marks",
    "so it looks much better
    "to put a space between the " and the text.

    CLEAR ev_result.  "the same is true at line end

    lv_value = 0."comment

    ls_pair = VALUE #(" initial comment
                       a = '3.1415'" pi
                       b = '1.4142'" sqrt(2)
                      )."final comment
  ENDMETHOD.
ENDCLASS.
