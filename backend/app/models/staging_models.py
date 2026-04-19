from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CsvFile(Base):
    __tablename__ = "csv_files"
    __table_args__ = (
        Index("ix_csv_files_dataset", "dataset"),
        Index("ix_csv_files_uploaded_at", "uploaded_at"),
        {"schema": "staging"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dataset: Mapped[str] = mapped_column(String(80), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64))
    delimiter: Mapped[str | None] = mapped_column(String(5))
    encoding: Mapped[str | None] = mapped_column(String(40))
    header: Mapped[list[str] | None] = mapped_column(JSON)
    row_count: Mapped[int | None] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    rows: Mapped[list[CsvRow]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class CsvRow(Base):
    __tablename__ = "csv_rows"
    __table_args__ = (
        Index("ix_csv_rows_file_row_number", "csv_file_id", "row_number", unique=True),
        {"schema": "staging"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    csv_file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("staging.csv_files.id", ondelete="CASCADE"), nullable=False
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    file: Mapped[CsvFile] = relationship(back_populates="rows")


class CsvRowError(Base):
    __tablename__ = "csv_row_errors"
    __table_args__ = (
        Index("ix_csv_row_errors_file_row_number", "csv_file_id", "row_number"),
        {"schema": "staging"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    csv_file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("staging.csv_files.id", ondelete="CASCADE"), nullable=False
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    error_code: Mapped[str] = mapped_column(String(80), nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    raw_data: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
