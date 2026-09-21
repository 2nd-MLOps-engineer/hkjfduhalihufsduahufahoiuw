from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("nickname", "age_group", "city", "created_at")
    search_fields = ("nickname", "city")

# Register your models here.
