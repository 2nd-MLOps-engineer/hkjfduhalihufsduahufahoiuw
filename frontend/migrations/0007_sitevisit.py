from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("frontend", "0006_friendrequest"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteVisit",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("visitor_key", models.CharField(max_length=64)),
                ("visited_on", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="sitevisit",
            constraint=models.UniqueConstraint(
                fields=("visitor_key", "visited_on"),
                name="unique_site_visit_per_day",
            ),
        ),
    ]
