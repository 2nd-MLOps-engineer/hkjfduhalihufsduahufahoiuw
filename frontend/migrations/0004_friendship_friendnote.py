# Generated manually for the friend and guestbook feature.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("frontend", "0003_workoutprogress_friend_code"),
    ]

    operations = [
        migrations.CreateModel(
            name="FriendNote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(max_length=60)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="friend_notes", to="frontend.member")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Friendship",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("friend", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="added_by_friendships", to="frontend.member")),
                ("member", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="friendships", to="frontend.member")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="friendship",
            constraint=models.UniqueConstraint(fields=("member", "friend"), name="unique_member_friend"),
        ),
    ]
