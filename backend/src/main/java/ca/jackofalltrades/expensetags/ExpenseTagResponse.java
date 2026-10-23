package ca.jackofalltrades.expensetags;

/** The {@code ExpenseTag} JSON in contract §5.1. */
public record ExpenseTagResponse(Integer id, String name) {

    public static ExpenseTagResponse from(ExpenseTag tag) {
        return new ExpenseTagResponse(tag.getId(), tag.getName());
    }
}
