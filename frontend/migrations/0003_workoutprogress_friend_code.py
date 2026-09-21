from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("frontend", "0002_member")]

    operations = [
        migrations.AddField(
            model_name="member",
            name="friend_code",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        migrations.CreateModel(
            name="WorkoutProgress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("total_calories", models.PositiveIntegerField(default=0)),
                ("entries", models.JSONField(blank=True, default=list)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("member", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="workout_progress", to="frontend.member")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
