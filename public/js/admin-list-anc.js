$(function () {
    $(".delete-btn").click(function () {
        const id = $(this).data("id");
        const title = $(this).data("title");
        $(".modal-body #id").text(id);
        $(".modal-body #title").text(title);
        $(".modal-footer #yes").attr("href", "/admin/delete/anc/" + id);
        $(".modal-body #ancid").attr("value", id);
    });

    $("#adminAncSearch").on("input", function () {
        const value = $(this).val().toLowerCase();
        $("#adminAncTable tbody tr").each(function () {
            const text = $(this).text().toLowerCase();
            $(this).toggle(text.indexOf(value) > -1);
        });
    });
});
